const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  SlashCommandBuilder,
  Routes,
  WebhookClient,
} = require("discord.js");

const { REST } = require("@discordjs/rest");
const { request } = require("undici");
const net = require("node:net");
const si = require("systeminformation");
const Sequelize = require("sequelize");
const { time } = require("discord.js");
const yaml = require("js-yaml");
const fs = require("fs");

const config = yaml.load(fs.readFileSync("./settings.yml", "utf8"));

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", () => {
  Data.sync();
  console.log(`Logged in as ${client.user.tag}!`);
});

client.login(config.token);

const ping = require("ping");

const sequelize = new Sequelize("database", "user", "password", {
  host: "localhost",
  dialect: "sqlite",
  logging: false,
  // SQLite only
  storage: "database.sqlite",
});

const Data = sequelize.define("data", {
  display_name: {
    type: Sequelize.TEXT,
    unique: true,
  },
  hostname: Sequelize.STRING,
  down: Sequelize.BOOLEAN,
  downtime: {
    type: Sequelize.INTEGER,
    allowNull: false,
  },
  port: {
    type: Sequelize.INTEGER,
    defaultValue: 80,
    allowNull: false,
  },
});

const date = new Date();

const timeString = time(date);

const webhookClient = new WebhookClient({
  url: config.webhook.link,
});

const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Look-up and ping an IP address.")
    .addStringOption((option) =>
      option.setName("ip").setDescription("IP Address")
    ),

  new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("View this bot infrastructure."),

  new SlashCommandBuilder()
    .setName("add")
    .setDescription("Add a monitor to see its uptime.")
    .addStringOption((option) =>
      option.setName("display_name").setDescription("Display Name")
    )
    .addStringOption((option) =>
      option.setName("hostname").setDescription("Hostname")
    )
    .addIntegerOption((option) =>
      option.setName("port").setDescription("Port")
    ),

  new SlashCommandBuilder().setName("nuke").setDescription("Nuke a channel."),
].map((command) => command.toJSON());

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const interactionUser = await interaction.guild.members.fetch(
    interaction.user.id
  );

  const userTag = interactionUser.user.tag;

  const { commandName } = interaction;
  await interaction.deferReply();

  if (commandName === "ping") {
    const ipInput = interaction.options.getString("ip");

    if (!ipInput) {
      await interaction.editReply({
        content: "You must specify an IP address first!",
        components: [],
      });
    } else {
      const ipResult = await request(config.ip_lookup_api + ipInput);

      const result = await ping.promise.probe(ipInput, {
        timeout: 10,
        extra: ["-i", "2"],
      });

      const { timezone, as, regionName, country, city } = await getJSONResponse(
        ipResult.body
      );

      const ipMsg = net.isIPv4(ipInput)
        ? "**IPv4 Address**: "
        : "**IPv6 Address**: ";

      const ipEmbed = new EmbedBuilder()
        .setColor("#32a858")
        .setTitle("IP Ping & Lookup")
        .setDescription(
          ipMsg +
            ipInput +
            "\n**Location**: " +
            city +
            ", " +
            regionName +
            ", " +
            country +
            "\n**ISP/ASN**: " +
            as +
            "\n**Timezone**: " +
            timezone +
            "\n\n```" +
            result.output +
            "```"
        )
        .setFooter({ text: "Requested by " + userTag })
        .setTimestamp();

      await interaction.editReply({ embeds: [ipEmbed] });
    }
  }
  if (commandName === "serverinfo") {
    const cpu = await si.cpu();
    const time = await si.time();
    const mb = await si.mem();
    const sys = await si.system();
    const os = await si.osInfo();
    let usedMB = mb.used / 1000000000;
    let totalMB = mb.total / 1000000000;

    const vm = sys.virtual ? "Yes" : "No";
    const serverEmbed = new EmbedBuilder()
      .setColor("#32a858")
      .setTitle("Bot Infrastructure")
      .setDescription(
        "**CPU**: " +
          cpu.brand +
          "\n**Speed**: " +
          cpu.speed +
          " GHz" +
          "\n**Cores**: " +
          cpu.cores +
          "\n**Physical Cores**: " +
          cpu.physicalCores +
          "\n**Virtual Machine**: " +
          vm +
          "\n**OS**: " +
          os.distro +
          "\n**Timezone**: " +
          time.timezone +
          "\n**RAM**: " +
          usedMB.toFixed(0) +
          "GB/" +
          totalMB.toFixed(0) +
          "GB"
      )
      .setFooter({ text: "Requested by " + userTag })
      .setTimestamp();

    await interaction.editReply({ embeds: [serverEmbed] });
  }

  // If you need this feature, remove the comment.

  // if (commandName === "nuke") {
  //   interaction.channel.clone().then((channel) => {
  //     const serverEmbed = new EmbedBuilder()
  //       .setColor("#32a858")
  //       .setTitle("Channel Nuked")
  //       .setDescription("Everything went poof.")
  //       .setImage("https://media.giphy.com/media/GzVvGQYhFZIAg/giphy.gif")
  //       .setFooter({ text: "Requested by " + userTag })
  //       .setTimestamp();

  //     channel.send({ embeds: [serverEmbed] });
  //   });
  //   interaction.channel.delete();
  // }

  if (commandName === "add") {
    const display_name = interaction.options.getString("display_name");
    const hostname = interaction.options.getString("hostname");
    const port = interaction.options.getInteger("port");

    if (!display_name || !hostname) {
      await interaction.editReply({
        content: "You must specify all required details first!",
        components: [],
      });
    } else {
      try {
        const data = await Data.create({
          display_name: display_name,
          hostname: hostname,
          down: await isPortReachable(port, { host: hostname }),
          downtime: 0,
          port: port || 80,
        });

        await interaction.editReply({
          content: `Monitor **${data.display_name}** added successfully.`,
          components: [],
        });
      } catch (error) {
        if (error.name === "SequelizeUniqueConstraintError") {
          await interaction.editReply({
            content: "That monitor already exists.",
            components: [],
          });
        } else {
          await interaction.editReply({
            content: "Something went wrong. (" + error.name + ")",
            components: [],
          });
        }
      }
    }
  }
});
const rest = new REST({ version: "10" }).setToken(config.token);

rest
  .put(Routes.applicationCommands(config.client_id), { body: commands })
  .then((data) =>
    console.log(`Successfully registered ${data.length} slash commands.`)
  )
  .catch(console.error);

async function getJSONResponse(body) {
  let fullBody = "";

  for await (const data of body) {
    fullBody += data.toString();
  }

  return JSON.parse(fullBody);
}

async function isPortReachable(port, { host, timeout = config.timeout } = {}) {
  const promise = new Promise((resolve, reject) => {
    const socket = new net.Socket();

    const onError = () => {
      socket.destroy();
      reject();
    };

    socket.setTimeout(timeout);
    socket.once("error", onError);
    socket.once("timeout", onError);

    socket.connect(port, host, () => {
      socket.end();
      resolve();
    });
  });

  try {
    await promise;
    return true;
  } catch {
    return false;
  }
}

setInterval(async () => {
  const monitors = await Data.findAll();

  monitors.map(async (d) => {
    const isAlive = await isPortReachable(d.port, { host: d.hostname });

    const status = await Data.findOne({
      where: { display_name: d.display_name },
    });

    if (isAlive) {
      const status = await Data.findOne({
        where: { display_name: d.display_name },
      });

      if (status.down) {
        const embed = new EmbedBuilder()
          .setColor("#32a858")
          .setTitle(d.display_name + " is now up!")
          .setDescription(
            "**Hostname**: " +
              d.hostname +
              ":" +
              d.port +
              "\n**Check Date**: " +
              timeString +
              "\n**Downtime**: Unknown"
          );

        sendWebhookMessage(embed, null);

        await Data.update(
          { down: false },
          { where: { display_name: d.display_name } }
        );
      }
    } else {
      if (!status.down) {
        const embed = new EmbedBuilder()
          .setColor("#eb4034")
          .setTitle(d.display_name + " is now down!")
          .setDescription(
            "**Hostname**: " +
              "`" + d.hostname + "`" +
              ":" +
              d.port +
              "\n**Check Date**: " +
              timeString +
              "\n**Encountered Error**: Timed Out"
          );

        sendWebhookMessage(embed, null);

        await Data.update(
          { down: true },
          { where: { display_name: d.display_name } }
        );
      }
    }
  });
}, config.check_duration * 1000); // in seconds

function sendWebhookMessage(embed, message) {
  if (message != null) {
    if ((config.webhook.avatar = "none")) {
      webhookClient.send({
        content: message,
        embeds: [embed],
        username: config.webhook.username,
      });
    } else {
      webhookClient.send({
        content: message,
        embeds: [embed],
        username: config.webhook.username,
        avatarURL: config.webhook.avatar,
      });
    }
  } else {
    if ((config.webhook.avatar = "none")) {
      webhookClient.send({
        embeds: [embed],
        username: config.webhook.username,
      });
    } else {
      webhookClient.send({
        embeds: [embed],
        username: config.webhook.username,
        avatarURL: config.webhook.avatar,
      });
    }
  }
}
