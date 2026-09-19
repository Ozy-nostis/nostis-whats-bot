import { handleBotRoutes } from "./bot.routes";
import { handleProfileRoutes } from "./profile.routes";
import { handleGroupRoutes } from "./group.routes";
import { handleRuleRoutes } from "./rule.routes";
import { handleCampaignRoutes } from "./campaign.routes";
import { handleLeadRoutes } from "./lead.routes";
import { handleStickerRoutes } from "./sticker.routes";
import { handleSettingsRoutes } from "./settings.routes";

export async function handleApiRequest(req: Request, url: URL): Promise<Response | null> {
  const botRes = await handleBotRoutes(req, url);
  if (botRes) return botRes;

  const profileRes = await handleProfileRoutes(req, url);
  if (profileRes) return profileRes;

  const groupRes = await handleGroupRoutes(req, url);
  if (groupRes) return groupRes;

  const ruleRes = await handleRuleRoutes(req, url);
  if (ruleRes) return ruleRes;

  const campaignRes = await handleCampaignRoutes(req, url);
  if (campaignRes) return campaignRes;

  const leadRes = await handleLeadRoutes(req, url);
  if (leadRes) return leadRes;

  const stickerRes = await handleStickerRoutes(req, url);
  if (stickerRes) return stickerRes;

  const settingsRes = await handleSettingsRoutes(req, url);
  if (settingsRes) return settingsRes;

  return null;
}
