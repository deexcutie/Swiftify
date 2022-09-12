const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  SlashCommandBuilder,
  Routes,
} = require("discord.js");

const { REST } = require("@discordjs/rest");
const { request } = require("undici");
const net = require("node:net");
const si = require("systeminformation");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
require("dotenv").config();

const ping = require("ping");

client.once("ready", () => {
  console.log("Ready.");
});

client.login(process.env.TOKEN);

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
      const ipResult = await request("http://ip-api.com/json/" + ipInput);

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

  if (commandName === "nuke") {
    interaction.channel.clone().then((channel) => {
      const serverEmbed = new EmbedBuilder()
        .setColor("#32a858")
        .setTitle("Channel Nuked")
        .setDescription("Everything went poof.")
        .setImage("https://media.giphy.com/media/GzVvGQYhFZIAg/giphy.gif")
        .setFooter({ text: "Requested by " + userTag })
        .setTimestamp();

      channel.send({ embeds: [serverEmbed] });
    });
    interaction.channel.delete();
  }
});
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

rest
  .put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands })
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
