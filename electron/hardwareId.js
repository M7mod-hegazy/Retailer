const { execSync } = require("child_process");
const crypto = require("crypto");

// Read the stable Windows system UUID (motherboard/firmware identifier).
// This is the ONLY anchor we use: it survives reboots, PC renames, disk
// reformats and RAM/GPU swaps, and only changes when the motherboard itself is
// replaced — making it both stable for real customers and hard to clone.
function readWindowsMachineUuid() {
  const commands = [
    'powershell -NoProfile -Command "(Get-CimInstance -ClassName Win32_ComputerSystemProduct).UUID"',
    'powershell -NoProfile -Command "(Get-WmiObject -Class Win32_ComputerSystemProduct).UUID"',
    "wmic csproduct get uuid",
  ];

  for (const command of commands) {
    try {
      const output = execSync(command, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      const normalized = String(output || "")
        .replace(/UUID/gi, "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .join("");
      // Reject the well-known "all zeroes" placeholder some firmwares report.
      if (normalized && !/^[0-]+$/.test(normalized)) return normalized;
    } catch (_error) {
      // Try the next strategy.
    }
  }

  return "";
}

function readLinuxMachineId() {
  try {
    return execSync("cat /etc/machine-id", { encoding: "utf8" }).trim();
  } catch (_error) {
    return "";
  }
}

// Returns the 32-char hex fingerprint for this machine.
//
// IMPORTANT: there is intentionally NO divergent fallback. If the hardware id
// cannot be read we throw, so the caller surfaces a clear "could not read
// hardware id" state and enters a short grace window — rather than silently
// computing a *different* id (which would look like a different PC and lock out
// a legitimate customer).
function getHardwareId() {
  const raw =
    process.platform === "win32"
      ? readWindowsMachineUuid()
      : readLinuxMachineId();

  const cleaned = String(raw).replace(/\s/g, "");
  if (!cleaned) {
    const err = new Error("hardware_id_unreadable");
    err.code = "HARDWARE_ID_UNREADABLE";
    throw err;
  }

  return crypto
    .createHash("sha256")
    .update(cleaned)
    .digest("hex")
    .substring(0, 32);
}

// Non-throwing convenience wrapper: returns { hardwareId } or { error }.
function tryGetHardwareId() {
  try {
    return { hardwareId: getHardwareId() };
  } catch (error) {
    return { error: error.code || "hardware_id_unreadable" };
  }
}

module.exports = { getHardwareId, tryGetHardwareId };
