const { Menu, app } = require("electron");

function buildMenu(mainWindow) {
  const template = [
    {
      label: "ملف",
      submenu: [
        {
          label: "نسخ احتياطي",
          click: () => mainWindow?.webContents.send("menu:backup"),
        },
        { type: "separator" },
        { label: "تصغير", click: () => mainWindow?.minimize() },
        { type: "separator" },
        { label: "خروج", click: () => app.quit() },
      ],
    },
    {
      label: "تحرير",
      submenu: [
        { role: "undo", label: "تراجع" },
        { role: "redo", label: "إعادة" },
        { type: "separator" },
        { role: "cut", label: "قص" },
        { role: "copy", label: "نسخ" },
        { role: "paste", label: "لصق" },
        { role: "selectAll", label: "تحديد الكل" },
      ],
    },
    {
      label: "عرض",
      submenu: [
        { role: "reload", label: "إعادة تحميل" },
        { role: "toggleDevTools", label: "أدوات المطور" },
        { type: "separator" },
        { role: "resetZoom", label: "حجم افتراضي" },
        { role: "zoomIn", label: "تكبير" },
        { role: "zoomOut", label: "تصغير" },
        { type: "separator" },
        { role: "togglefullscreen", label: "ملء الشاشة" },
      ],
    },
    {
      label: "مساعدة",
      submenu: [
        {
          label: "حول ElHegazi Retailer",
          click: () => {
            const { dialog } = require("electron");
            dialog.showMessageBox(mainWindow, {
              type: "info",
              title: "حول التطبيق",
              message: `ElHegazi Retailer v${app.getVersion()}\nنظام إدارة نقاط البيع`,
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

module.exports = { buildMenu };
