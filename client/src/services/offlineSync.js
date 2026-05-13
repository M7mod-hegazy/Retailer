import { openDB } from "idb";
import toast from "react-hot-toast";

const DB_NAME = "retailer_offline_db";
const DB_VERSION = 1;

export async function getOfflineDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("sync_queue")) {
        db.createObjectStore("sync_queue", { keyPath: "id", autoIncrement: true });
      }
    },
  });
}

export async function queueOfflineInvoice(invoiceData) {
  const db = await getOfflineDB();
  await db.add("sync_queue", {
    type: "INVOICE",
    payload: invoiceData,
    timestamp: Date.now(),
  });
  toast.success("تم تشغيل وضع عدم الاتصال: تم حفظ الفاتورة محلياً وستزامن قريباً", {
    icon: "🔌",
  });
}

export async function syncOfflineData(apiClient) {
  const db = await getOfflineDB();
  const queue = await db.getAll("sync_queue");
  
  if (queue.length === 0) return;
  
  let successCount = 0;
  for (const item of queue) {
    try {
      if (item.type === "INVOICE") {
        await apiClient.post("/api/invoices", item.payload);
        await db.delete("sync_queue", item.id);
        successCount++;
      }
    } catch (err) {
      console.error("Failed to sync item", item, err);
    }
  }

  if (successCount > 0) {
    toast.success(`تمت المزامنة بنجاح: ${successCount} فاتورة/بيانات`, {
      icon: "🔄",
    });
  }
}
