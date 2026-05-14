module.exports = {
  version: 36,
  description: "Add partner_branch to branch_transfers, warehouse_id to branch_transfer_lines",
  up(db) {
    db.exec(`
      ALTER TABLE branch_transfers ADD COLUMN partner_branch TEXT;
      ALTER TABLE branch_transfer_lines ADD COLUMN warehouse_id INTEGER REFERENCES warehouses(id);
      UPDATE branch_transfer_lines 
      SET warehouse_id = (SELECT warehouse_id FROM branch_transfers WHERE branch_transfers.id = branch_transfer_lines.transfer_id);
    `);
  },
};
