const { z } = require("zod");

const invoiceLineSchema = z.object({
  item_id: z.number().int().positive(),
  quantity: z.number().int().positive(),
  unit_price: z.number().int().nonnegative(),
});

const invoiceSchema = z.object({
  customer_id: z.number().int().positive().optional(),
  discount: z.number().int().nonnegative().default(0),
  payment_type: z.enum(["cash", "credit"]).default("cash"),
  lines: z.array(invoiceLineSchema).min(1),
});

module.exports = {
  invoiceLineSchema,
  invoiceSchema,
};
