const { execSync } = require("child_process");
const crypto = require("crypto");
const os = require("os");

function readWindowsMachineId() {
  const commands = [
    "powershell -NoProfile -Command \"(Get-CimInstance -ClassName Win32_ComputerSystemProduct).UUID\"",
    "powershell -NoProfile -Command \"(Get-WmiObject -Class Win32_ComputerSystemProduct).UUID\"",
    "wmic csproduct get uuid",
  ];

  for (const command of commands) {
    try {
      const output = execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      const normalized = String(output || "")
        .replace(/UUID/gi, "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .join("");
      if (normalized) return normalized;
    } catch (_error) {
      // Try next strategy.
    }
  }

  return "";
}

function getHardwareId() {
  try {
    let raw = "";
    if (process.platform === "win32") {
      raw = readWindowsMachineId();
    } else {
      raw = execSync("cat /etc/machine-id", { encoding: "utf8" });
    }
    const cleaned = String(raw).replace(/\s/g, "").replace("UUID", "");
    if (!cleaned) throw new Error("No hardware identifier");
    return crypto.createHash("sha256").update(cleaned + os.hostname()).digest("hex").substring(0, 32);
  } catch {
    return crypto.createHash("sha256").update(os.hostname() + os.cpus()[0]?.model).digest("hex").substring(0, 32);
  }
}

module.exports = { getHardwareId };
