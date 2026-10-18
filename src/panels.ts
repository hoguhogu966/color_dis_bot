import {
  ActionRowBuilder,
  EmbedBuilder,
  StringSelectMenuBuilder,
  type ChatInputCommandInteraction,
  type Guild,
  type StringSelectMenuInteraction,
  type TextBasedChannel,
  type TextChannel,
} from "discord.js";
import { addPanelRole, deletePanel, getPanelRoles, setPanelRoles } from "./store.js";

const CUSTOM_ID = "color-role";
const MAX_SELECT_OPTIONS = 25;

function buildComponents(roles: { label: string; roleId: string }[]) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(CUSTOM_ID)
    .setPlaceholder("Select a role")
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(roles.map((role) => ({ label: role.label, value: role.roleId })));

  return [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)];
}

function parseRoles(
  input: string,
  guild: Guild | null,
): { label: string; roleId: string }[] {
  const roleIds = [
    ...new Set(
      [...input.matchAll(/<@&(\d+)>/g)]
        .map((match) => match[1])
        .filter((id): id is string => id !== undefined),
    ),
  ];

  if (!guild) {
    return [];
  }

  return roleIds.flatMap((roleId) => {
    const role = guild.roles.cache.get(roleId);
    return role ? [{ label: role.name, roleId: role.id }] : [];
  });
}

export async function handleCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (interaction.commandName !== "panel") {
    return;
  }

  switch (interaction.options.getSubcommand()) {
    case "create":
      await createPanel(interaction);
      break;
    case "add-role":
      await addRole(interaction);
      break;
    case "delete":
      await removePanel(interaction);
      break;
  }
}

async function createPanel(interaction: ChatInputCommandInteraction): Promise<void> {
  const channelOption = interaction.options.getChannel("channel", true);
  const title = interaction.options.getString("title", true);
  const rolesInput = interaction.options.getString("roles", true);

  const roles = parseRoles(rolesInput, interaction.guild).slice(0, MAX_SELECT_OPTIONS);
  if (roles.length === 0) {
    await interaction.reply({
      content: "At least one valid role mention is required.",
      ephemeral: true,
    });
    return;
  }

  const channel = await interaction.guild?.channels
    .fetch(channelOption.id)
    .catch(() => null);

  if (!channel?.isTextBased()) {
    await interaction.reply({ content: "A text channel is required.", ephemeral: true });
    return;
  }

  const embed = new EmbedBuilder().setTitle(title).setDescription("Pick a role below.");
  const message = await (channel as TextChannel).send({
    embeds: [embed],
    components: buildComponents(roles),
  });

  setPanelRoles(message.id, roles);
  await interaction.reply({ content: `Panel created: ${message.id}`, ephemeral: true });
}

async function addRole(interaction: ChatInputCommandInteraction): Promise<void> {
  const messageId = interaction.options.getString("message_id", true);
  const rolesInput = interaction.options.getString("roles", true);
  const label = interaction.options.getString("label");

  const roles = parseRoles(rolesInput, interaction.guild);
  if (roles.length === 0) {
    await interaction.reply({
      content: "At least one valid role mention is required.",
      ephemeral: true,
    });
    return;
  }

  const first = roles[0];
  if (label && roles.length === 1 && first) {
    first.label = label;
  }

  const existing = getPanelRoles(messageId);
  if (existing.length + roles.length > MAX_SELECT_OPTIONS) {
    await interaction.reply({
      content: `Panel can hold at most ${MAX_SELECT_OPTIONS} roles.`,
      ephemeral: true,
    });
    return;
  }

  for (const role of roles) {
    addPanelRole(messageId, role);
  }
  await refreshPanel(interaction.channel, messageId);
  await interaction.reply({ content: `Roles added to ${messageId}`, ephemeral: true });
}

async function removePanel(interaction: ChatInputCommandInteraction): Promise<void> {
  const messageId = interaction.options.getString("message_id", true);

  deletePanel(messageId);
  await interaction.reply({ content: `Panel deleted: ${messageId}`, ephemeral: true });
}

async function refreshPanel(
  channel: TextBasedChannel | null,
  messageId: string,
): Promise<void> {
  if (!channel?.isTextBased()) {
    return;
  }

  const message = await channel.messages.fetch(messageId).catch(() => null);
  if (!message) {
    return;
  }

  await message.edit({ components: buildComponents(getPanelRoles(messageId)) });
}

export async function handleSelectMenu(
  interaction: StringSelectMenuInteraction,
): Promise<void> {
  if (interaction.customId !== CUSTOM_ID || !interaction.guild) {
    return;
  }

  const selected = interaction.values[0];
  if (!selected) {
    return;
  }

  const roles = getPanelRoles(interaction.message.id);
  const toRemove = roles
    .map((role) => role.roleId)
    .filter((roleId) => roleId !== selected);

  const member = await interaction.guild.members.fetch(interaction.user.id);
  await member.roles.remove(toRemove, "color role panel");
  await member.roles.add(selected, "color role panel");

  await interaction.reply({ content: "Role updated.", ephemeral: true });
}
