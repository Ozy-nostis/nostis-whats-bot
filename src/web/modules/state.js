export const state = {
  allGroups: [],
  enabledSet: new Set(),
  groupDelays: new Map(),

  allRules: [],
  editingRuleId: null,

  allLeads: [],
  allBans: [],
  allCallers: [],
  metricsPageSize: 15,
  metricsPage: 1,

  allProfiles: [],
  activeProfileId: null,

  allCampaigns: [],
  editingCampaignId: null,
  editingCampaignMedia: null,
  campaignSelectedGroups: new Set(),
  campaignHasNewMediaFile: false,
  campaignMediaRemoved: false,
  campaignPendingGalleryStickerId: null,
  campaignPollTimers: new Map(),
};
