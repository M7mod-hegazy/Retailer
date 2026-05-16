const fs = require('fs');
const buf = fs.readFileSync('D:\\code\\retailer\\server\\data\\retailer.db');
const text = buf.toString('utf8');
const idx = text.indexOf('branch_transfers');
if (idx >= 0) {
  console.log('Found at byte', idx);
  console.log(text.substring(Math.max(0, idx - 20), idx + 400));
} else {
  console.log('Not found');
}
// Also check for warehouse_id in the file
const widx = text.indexOf('warehouse_id');
console.log('warehouse_id found at', widx);
