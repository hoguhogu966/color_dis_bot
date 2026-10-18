import {
  ActionRowBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  type ChatInputCommandInteraction,
  type Guild,
  type StringSelectMenuInteraction,
  type Role,
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

const DANGEROUS_PERMISSIONS = [
  PermissionFlagsBits.Administrator,
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.ManageGuild,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.ManageWebhooks,
  PermissionFlagsBits.ManageEvents,
  PermissionFlagsBits.ManageThreads,
  PermissionFlagsBits.ManageMessages,
  PermissionFlagsBits.BanMembers,
  PermissionFlagsBits.KickMembers,
  PermissionFlagsBits.ModerateMembers,
];

function dangerousCheck(role: Role): string | null {
  if (role.permissions.has(PermissionFlagsBits.Administrator)) {
    return role.name + " has Administrator permission and cannot be added to a panel.";
  }
  const permission = DANGEROUS_PERMISSIONS.find((flag) => role.permissions.has(flag));
  if (permission) {
    return role.name + " has sensitive permissions and cannot be added to a panel.";
  }
  return null;
}

function assignableReason(role: Role): string | null {
  if (role.managed) {
    return `${role.name} is managed by an integration and cannot be assigned.`;
  }
  const me = role.guild.members.me;
  if (!me) {
    return "Bot member is not available yet, please retry in a moment.";
  }
  if (me.roles.highest.comparePositionTo(role) <= 0) {
    return `${role.name} is at or above the bot's highest role and cannot be assigned.`;
  }
  return null;
}

async function validatePanelRoles(
  interaction: ChatInputCommandInteraction,
  panelRoles: { label: string; roleId: string }[],
): Promise<boolean> {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({
      content: "A role could not be found in this server.",
      ephemeral: true,
    });
    return false;
  }

  for (const panelRole of panelRoles) {
    const role = await guild.roles.fetch(panelRole.roleId).catch(() => null);
    if (!role) {
      await interaction.reply({
        content: "A role could not be found in this server.",
        ephemeral: true,
      });
      return false;
    }
    const reason = dangerousCheck(role) ?? assignableReason(role);
    if (reason) {
      await interaction.reply({ content: reason, ephemeral: true });
      return false;
    }
  }

  return true;
}

export async function handleCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (interaction.commandName !== "panel") {
    return;
  }

  if (!interaction.inGuild() || !interaction.memberPermissions?.has("ManageRoles")) {
    await interaction.reply({
      content: "You need the Manage Roles permission to manage panels.",
      ephemeral: true,
    });
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

  if (!(await validatePanelRoles(interaction, roles))) {
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
  const message = await (channel as TextChannel)
    .send({
      embeds: [embed],
      components: buildComponents(roles),
    })
    .catch(async (error) => {
      console.error("Failed to send panel message:", error);
      await interaction.reply({
        content:
          "Failed to send the panel message. Check the bot's permissions in that channel.",
        ephemeral: true,
      });
      return null;
    });

  if (!message) {
    return;
  }

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
  if (existing.length === 0) {
    await interaction.reply({
      content: `No panel found for message ${messageId}.`,
      ephemeral: true,
    });
    return;
  }
  if (existing.length + roles.length > MAX_SELECT_OPTIONS) {
    await interaction.reply({
      content: `Panel can hold at most ${MAX_SELECT_OPTIONS} roles.`,
      ephemeral: true,
    });
    return;
  }
  const duplicate = existing.find((panelRole) =>
    roles.some((role) => role.roleId === panelRole.roleId),
  );
  if (duplicate) {
    await interaction.reply({
      content: `${duplicate.label} is already on this panel.`,
      ephemeral: true,
    });
    return;
  }

  if (!(await validatePanelRoles(interaction, roles))) {
    return;
  }

  for (const panelRole of roles) {
    addPanelRole(messageId, panelRole);
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
  if (interaction.customId !== CUSTOM_ID || !interaction.inGuild()) {
    return;
  }

  const selected = interaction.values[0];
  if (!selected) {
    return;
  }

  const roles = getPanelRoles(interaction.message.id);
  const panelRole = roles.find((role) => role.roleId === selected);
  if (!panelRole) {
    await interaction.reply({
      content: "This role is no longer on the panel.",
      ephemeral: true,
    });
    return;
  }

  const guild = interaction.guild;
  if (!guild) {
    return;
  }
  const member = await guild.members.fetch(interaction.user.id);
  const role = await guild.roles.fetch(selected).catch(() => null);
  if (!role) {
    await interaction.reply({
      content: "The selected role no longer exists.",
      ephemeral: true,
    });
    return;
  }

  const reason = dangerousCheck(role) ?? assignableReason(role);
  if (reason) {
    await interaction.reply({ content: reason, ephemeral: true });
    return;
  }

  const toRemove = roles
    .map((other) => other.roleId)
    .filter((roleId) => roleId !== selected && member.roles.cache.has(roleId));

  try {
    if (toRemove.length > 0) {
      await member.roles.remove(toRemove, "color role panel");
    }
    await member.roles.add(selected, "color role panel");
  } catch (error) {
    console.error("Failed to update member roles:", error);
    await interaction.reply({
      content: "Failed to update your roles. Please contact an admin.",
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({
    content: `Role updated: ${panelRole.label}`,
    ephemeral: true,
  });
}
