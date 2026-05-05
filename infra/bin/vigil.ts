import * as cdk from 'aws-cdk-lib';
import { VigilStack } from '../lib/vigil-stack';

const app = new cdk.App();

new VigilStack(app, 'VigilStack', {
  env: {
    ...(process.env['CDK_DEFAULT_ACCOUNT'] && { account: process.env['CDK_DEFAULT_ACCOUNT'] }),
    region: process.env['CDK_DEFAULT_REGION'] ?? 'us-east-1',
  },
});
