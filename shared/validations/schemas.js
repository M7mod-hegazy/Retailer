const { z } = require("zod");

const authLoginSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
});

const companySettingsSchema = z.object({
  company_name: z.string().min(2),
  vat_number: z.string().optional().default(""),
  tax_rate: z.number().int().min(0).max(100),
});

module.exports = {
  authLoginSchema,
  companySettingsSchema,
};
