import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as iam from 'aws-cdk-lib/aws-iam';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import type { Construct } from 'constructs';

export class VigilStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ---- Dead-letter queue ----
    const dlq = new sqs.Queue(this, 'VigilDLQ', {
      retentionPeriod: cdk.Duration.days(14),
      queueName: 'vigil-dlq',
    });

    // ---- Shared Lambda environment ----
    const sharedEnv: Record<string, string> = {
      NODE_ENV: 'production',
      DATABASE_URL: process.env['DATABASE_URL'] ?? '',
      GEMINI_API_KEY: process.env['GEMINI_API_KEY'] ?? '',
      TAVILY_API_KEY: process.env['TAVILY_API_KEY'] ?? '',
      SES_FROM_ADDRESS: process.env['SES_FROM_ADDRESS'] ?? '',
      NEWSLETTER_RECIPIENTS: process.env['NEWSLETTER_RECIPIENTS'] ?? '',
      CHROMADB_CLOUD_API_KEY: process.env['CHROMADB_CLOUD_API_KEY'] ?? '',
      CHROMADB_CLOUD_TENANT_ID: process.env['CHROMADB_CLOUD_TENANT_ID'] ?? '',
    };

    // Prisma's native query engine binary must be copied alongside the esbuild
    // bundle — esbuild only handles JS, not .node files.
    const prismaBundling = {
      externalModules: ['@aws-sdk/*'],
      commandHooks: {
        beforeBundling: () => [],
        beforeInstall: () => [],
        afterBundling: (inputDir: string, outputDir: string) => [
          `cp ${inputDir}/node_modules/.prisma/client/libquery_engine-rhel-openssl-3.0.x.so.node ${outputDir}/`,
          `cp ${inputDir}/node_modules/.prisma/client/schema.prisma ${outputDir}/`,
        ],
      },
    };

    // ---- Collector Lambda ----
    const collectorFn = new NodejsFunction(this, 'CollectorFunction', {
      entry: '../services/collector.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.minutes(10),
      memorySize: 512,
      environment: sharedEnv,
      deadLetterQueue: dlq,
      bundling: prismaBundling,
    });

    // ---- Aggregator Lambda ----
    const aggregatorFn = new NodejsFunction(this, 'AggregatorFunction', {
      entry: '../services/aggregator.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      environment: sharedEnv,
      deadLetterQueue: dlq,
      bundling: prismaBundling,
    });

    // SES send permission
    aggregatorFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ses:SendEmail', 'sesv2:SendEmail'],
        resources: ['*'],
      }),
    );

    // ---- EventBridge schedules (all times CT = UTC-5 CDT / UTC-6 CST) ----

    // 05:00 CT = 11:00 UTC (CDT) — Morning collection, all regions
    new events.Rule(this, 'MorningCollectionRule', {
      schedule: events.Schedule.cron({ hour: '11', minute: '0' }),
      description: 'Project Vigil — morning collection 05:00 CT',
      targets: [
        new targets.LambdaFunction(collectorFn, {
          event: events.RuleTargetInput.fromObject({ region: 'local' }),
          retryAttempts: 2,
          deadLetterQueue: dlq,
        }),
        new targets.LambdaFunction(collectorFn, {
          event: events.RuleTargetInput.fromObject({ region: 'usa' }),
          retryAttempts: 2,
          deadLetterQueue: dlq,
        }),
        new targets.LambdaFunction(collectorFn, {
          event: events.RuleTargetInput.fromObject({ region: 'geopolitical' }),
          retryAttempts: 2,
          deadLetterQueue: dlq,
        }),
      ],
    });

    // 06:00 CT = 12:00 UTC (CDT) — Newsletter dispatch
    new events.Rule(this, 'NewsletterDispatchRule', {
      schedule: events.Schedule.cron({ hour: '12', minute: '0' }),
      description: 'Project Vigil — newsletter dispatch 06:00 CT',
      targets: [
        new targets.LambdaFunction(aggregatorFn, {
          retryAttempts: 1,
          deadLetterQueue: dlq,
        }),
      ],
    });

    // 12:00 CT = 18:00 UTC (CDT) — Midday flash (aggregator with short lookback)
    new events.Rule(this, 'MiddayFlashRule', {
      schedule: events.Schedule.cron({ hour: '18', minute: '0' }),
      description: 'Project Vigil — midday flash 12:00 CT',
      targets: [
        new targets.LambdaFunction(aggregatorFn, {
          event: events.RuleTargetInput.fromObject({ lookbackHours: 6 }),
          retryAttempts: 1,
          deadLetterQueue: dlq,
        }),
      ],
    });

    // Sunday 06:00 CT = 12:00 UTC (CDT) — Free tier weekly digest
    new events.Rule(this, 'WeeklyFreeDigestRule', {
      schedule: events.Schedule.cron({ hour: '12', minute: '0', weekDay: 'SUN' }),
      description: 'Project Vigil — free tier weekly digest 06:00 CT Sunday',
      targets: [
        new targets.LambdaFunction(aggregatorFn, {
          event: events.RuleTargetInput.fromObject({ isFreeWeekly: true }),
          retryAttempts: 1,
          deadLetterQueue: dlq,
        }),
      ],
    });

    // 18:00 CT = 00:00 UTC next day (CDT) — Evening collection
    new events.Rule(this, 'EveningCollectionRule', {
      schedule: events.Schedule.cron({ hour: '0', minute: '0' }),
      description: 'Project Vigil — evening collection 18:00 CT',
      targets: [
        new targets.LambdaFunction(collectorFn, {
          event: events.RuleTargetInput.fromObject({ region: 'local' }),
          retryAttempts: 2,
          deadLetterQueue: dlq,
        }),
        new targets.LambdaFunction(collectorFn, {
          event: events.RuleTargetInput.fromObject({ region: 'usa' }),
          retryAttempts: 2,
          deadLetterQueue: dlq,
        }),
        new targets.LambdaFunction(collectorFn, {
          event: events.RuleTargetInput.fromObject({ region: 'geopolitical' }),
          retryAttempts: 2,
          deadLetterQueue: dlq,
        }),
      ],
    });

    // ---- Outputs ----
    new cdk.CfnOutput(this, 'CollectorFunctionArn', { value: collectorFn.functionArn });
    new cdk.CfnOutput(this, 'AggregatorFunctionArn', { value: aggregatorFn.functionArn });
    new cdk.CfnOutput(this, 'DLQUrl', { value: dlq.queueUrl });
  }
}
