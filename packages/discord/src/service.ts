import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  ComponentType,
  EmbedBuilder,
  GatewayIntentBits,
  Message,
  TextChannel,
} from 'discord.js';
import type { Region } from '@vigil/shared';
import { loadConfig } from './config.js';
import type {
  ApprovalResult,
  BriefingHandler,
  CollectHandler,
  DigestHandler,
  FlagHandler,
  FlashHandler,
  ReviewHandler,
  ScanHandler,
  SourcesHandler,
  StatusHandler,
  VigilApprovalRequest,
} from './types.js';

const UNINITIALIZED = 'Agent not initialized yet.';

export class DiscordService {
  private readonly client: Client;
  private readonly config: ReturnType<typeof loadConfig>;
  private readonly channelRegionMap: Record<string, Region>;

  private collectHandler: CollectHandler | null = null;
  private scanHandler: ScanHandler | null = null;
  private statusHandler: StatusHandler | null = null;
  private sourcesHandler: SourcesHandler | null = null;
  private digestHandler: DigestHandler | null = null;
  private flashHandler: FlashHandler | null = null;
  private briefingHandler: BriefingHandler | null = null;
  private reviewHandler: ReviewHandler | null = null;
  private flagHandler: FlagHandler | null = null;

  constructor() {
    this.config = loadConfig();
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
      ],
    });
    this.channelRegionMap = {
      [this.config.discord.localChannelId]: 'local',
      [this.config.discord.usaChannelId]: 'usa',
      [this.config.discord.geoChannelId]: 'geopolitical',
    };
    this.setupEventHandlers();
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async connect(): Promise<void> {
    await this.client.login(this.config.discord.botToken);
  }

  async disconnect(): Promise<void> {
    this.client.destroy();
  }

  isConnected(): boolean {
    return this.client.isReady();
  }

  // ---------------------------------------------------------------------------
  // Messaging
  // ---------------------------------------------------------------------------

  async sendNotification(message: string, channelId?: string): Promise<void> {
    const id = channelId ?? this.config.discord.generalChannelId;
    const channel = await this.resolveTextChannel(id);
    await channel.send(message);
  }

  async sendEmbed(embed: EmbedBuilder, channelId: string): Promise<void> {
    const channel = await this.resolveTextChannel(channelId);
    await channel.send({ embeds: [embed] });
  }

  // ---------------------------------------------------------------------------
  // Approval flow
  // ---------------------------------------------------------------------------

  async requestApproval(
    request: VigilApprovalRequest,
    channelId?: string,
  ): Promise<ApprovalResult> {
    const id = channelId ?? this.config.discord.generalChannelId;
    const channel = await this.resolveTextChannel(id);

    const embed = new EmbedBuilder()
      .setColor(0xe67e22)
      .setTitle(`⚠️ Approval Required — ${request.type.replace('_', ' ').toUpperCase()}`)
      .addFields(
        { name: 'Headline', value: request.article.title },
        { name: 'Outlet', value: request.article.outlet, inline: true },
        { name: 'Bias Score', value: String(request.article.biasScore), inline: true },
        { name: 'Trust Rating', value: String(request.article.trustRating), inline: true },
        { name: 'Reason', value: request.reason },
        { name: 'Summary', value: request.article.summary },
        { name: 'Source', value: request.article.url },
      )
      .setFooter({ text: `Request ID: ${request.id} · ${request.requestedAt.toISOString()}` });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`vigil_approve_${request.id}`)
        .setLabel('Approve')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`vigil_reject_${request.id}`)
        .setLabel('Reject')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`vigil_edit_${request.id}`)
        .setLabel('Re-analyze')
        .setStyle(ButtonStyle.Secondary),
    );

    const msg = await channel.send({ embeds: [embed], components: [row] });

    return new Promise<ApprovalResult>((resolve) => {
      const collector = msg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === this.config.discord.adminUserId,
        time: 3_600_000, // 1 hour timeout
        max: 1,
      });

      collector.on('collect', async (interaction) => {
        await interaction.deferUpdate();
        const action = interaction.customId.startsWith(`vigil_approve_`)
          ? 'approve'
          : interaction.customId.startsWith(`vigil_reject_`)
            ? 'reject'
            : 'edit';
        resolve({ approved: action === 'approve', action });
      });

      collector.on('end', (collected) => {
        if (collected.size === 0) {
          resolve({ approved: false, action: 'reject', note: 'Timed out — auto-rejected.' });
        }
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Handler registration
  // ---------------------------------------------------------------------------

  registerCollectHandler(handler: CollectHandler): void {
    this.collectHandler = handler;
  }
  registerScanHandler(handler: ScanHandler): void {
    this.scanHandler = handler;
  }
  registerStatusHandler(handler: StatusHandler): void {
    this.statusHandler = handler;
  }
  registerSourcesHandler(handler: SourcesHandler): void {
    this.sourcesHandler = handler;
  }
  registerDigestHandler(handler: DigestHandler): void {
    this.digestHandler = handler;
  }
  registerFlashHandler(handler: FlashHandler): void {
    this.flashHandler = handler;
  }
  registerBriefingHandler(handler: BriefingHandler): void {
    this.briefingHandler = handler;
  }
  registerReviewHandler(handler: ReviewHandler): void {
    this.reviewHandler = handler;
  }
  registerFlagHandler(handler: FlagHandler): void {
    this.flagHandler = handler;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private setupEventHandlers(): void {
    this.client.on('messageCreate', (message: Message) => {
      void this.handleMessage(message);
    });
  }

  private async handleMessage(message: Message): Promise<void> {
    if (message.author.bot) return;
    if (message.author.id !== this.config.discord.adminUserId) return;
    if (!message.content.startsWith('!')) return;

    const [rawCmd, ...args] = message.content.slice(1).split(/\s+/);
    const cmd = rawCmd?.toLowerCase() ?? '';
    const channelId = message.channelId;
    const region = this.channelRegionMap[channelId];

    try {
      if (region) {
        await this.handleRegionCommand(message, cmd, args, region);
      } else if (channelId === this.config.discord.generalChannelId) {
        await this.handleGeneralCommand(message, cmd);
      }
    } catch (err) {
      await message.reply(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async handleRegionCommand(
    message: Message,
    cmd: string,
    args: string[],
    region: Region,
  ): Promise<void> {
    switch (cmd) {
      case 'collect':
        if (!this.collectHandler) return void message.reply(UNINITIALIZED);
        await this.collectHandler(region);
        break;
      case 'scan': {
        if (!this.scanHandler) return void message.reply(UNINITIALIZED);
        const topic = args.join(' ');
        if (!topic) return void message.reply('Usage: !scan <topic>');
        await this.scanHandler(region, topic);
        break;
      }
      case 'status':
        if (!this.statusHandler) return void message.reply(UNINITIALIZED);
        await this.statusHandler(region);
        break;
      case 'sources':
        if (!this.sourcesHandler) return void message.reply(UNINITIALIZED);
        await this.sourcesHandler(region);
        break;
      case 'review': {
        if (!this.reviewHandler) return void message.reply(UNINITIALIZED);
        const articleId = args[0];
        if (!articleId) return void message.reply('Usage: !review <articleId>');
        await this.reviewHandler(articleId);
        break;
      }
      case 'flag': {
        if (!this.flagHandler) return void message.reply(UNINITIALIZED);
        const articleId = args[0];
        if (!articleId) return void message.reply('Usage: !flag <articleId>');
        await this.flagHandler(articleId);
        break;
      }
      default:
        await message.reply(
          'Unknown command. Available: `!collect`, `!scan <topic>`, `!status`, `!sources`, `!review <id>`, `!flag <id>`',
        );
    }
  }

  private async handleGeneralCommand(message: Message, cmd: string): Promise<void> {
    switch (cmd) {
      case 'digest':
        if (!this.digestHandler) return void message.reply(UNINITIALIZED);
        await this.digestHandler();
        break;
      case 'flash':
        if (!this.flashHandler) return void message.reply(UNINITIALIZED);
        await this.flashHandler();
        break;
      case 'briefing':
        if (!this.briefingHandler) return void message.reply(UNINITIALIZED);
        await this.briefingHandler();
        break;
      case 'schedule':
        if (!this.statusHandler) return void message.reply(UNINITIALIZED);
        // schedule overview delegates to status across all regions
        await Promise.all(
          (['local', 'usa', 'geopolitical'] as Region[]).map((r) => this.statusHandler!(r)),
        );
        break;
      default:
        await message.reply(
          'Unknown command. Available: `!digest`, `!flash`, `!briefing`, `!schedule`',
        );
    }
  }

  private async resolveTextChannel(channelId: string): Promise<TextChannel> {
    const channel = await this.client.channels.fetch(channelId);
    if (!channel || !(channel instanceof TextChannel)) {
      throw new Error(`Channel ${channelId} is not a text channel or could not be fetched.`);
    }
    return channel;
  }
}
