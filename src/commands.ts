import { REST, Routes, SlashCommandBuilder } from "discord.js";
import { config } from "./config.js";

export const commands = [
  new SlashCommandBuilder()
    .setName("panel")
    .setDescription("Manage role panels")
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Create a role panel")
        .addChannelOption((o) =>
          o.setName("channel").setDescription("Target channel").setRequired(true),
        )
        .addStringOption((o) =>
          o.setName("title").setDescription("Panel title").setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName("roles")
            .setDescription("Role mentions separated by spaces (e.g. @Red @Blue)")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("add-role")
        .setDescription("Add role options to an existing panel")
        .addStringOption((o) =>
          o.setName("message_id").setDescription("Panel message id").setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName("roles")
            .setDescription("Role mentions separated by spaces (e.g. @Red @Blue)")
            .setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName("label")
            .setDescription("Display label (applies when a single role is given)"),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("delete")
        .setDescription("Delete a panel")
        .addStringOption((o) =>
          o.setName("message_id").setDescription("Panel message id").setRequired(true),
        ),
    ),
].map((command) => command.toJSON());

export async function registerCommands(): Promise<void> {
  const rest = new REST().setToken(config.token);

  const route = config.guildId
    ? Routes.applicationGuildCommands(config.clientId, config.guildId)
    : Routes.applicationCommands(config.clientId);

  await rest.put(route, { body: commands });
}
