const express = require("express");
const { transferTreasury } = require("../services/treasuryService");
const { authRequired } = require("../middleware/auth");
const { requirePagePermission } = require("../middleware/permission");

const router = express.Router();

router.use(authRequired);

router.post("/treasury/transfer", requirePagePermission("reports", "add"), (req, res, next) => {
  try {
    const payload = {
      source_id: req.body.source_id,
      destination_id: req.body.destination_id,
      amount: req.body.amount,
      reference: req.body.reference,
      notes: req.body.notes,
      user_id: req.user.id
    };

    const result = transferTreasury(payload);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/treasury-transfer", requirePagePermission("reports", "add"), (req, res, next) => {
  try {
    const payload = {
      source_id: req.body.source_id,
      destination_id: req.body.destination_id,
      amount: req.body.amount,
      reference: req.body.reference,
      notes: req.body.notes,
      user_id: req.user.id,
    };
    res.status(200).json(transferTreasury(payload));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
