// Add image_url to campaigns for image+text broadcast messages
module.exports = {
  name: "189_campaign_image",
  up(db) {
    const cols = db.prepare("PRAGMA table_info(campaigns)").all().map(c => c.name);
    if (!cols.includes("image_url")) {
      db.prepare("ALTER TABLE campaigns ADD COLUMN image_url TEXT").run();
    }
  },
};
