const fs = require("fs");
const path = "D:/code/retailer/client/src/components/auth/SupervisorPINModal.jsx";
let c = fs.readFileSync(path, "utf8");
c = c.replace("import api from \"../../services/api\";
import toast from \"react-hot-toast\";", "import api from \"../../services/api\";
import toast from \"react-hot-toast\";
import { useDetach } from \"../../hooks/useDetach\";");
c = c.replace("export default function SupervisorPINModal({ open, action, details, onSuccess, onClose }) {
  const [pin, setPin] = useState(\"\");", "export default function SupervisorPINModal({ open, action, details, onSuccess, onClose }) {
  const { handleDetach } = useDetach(\"supervisor-pin\", {
    onClose, getState: () => ({ action, details }), actions: { success: () => onSuccess?.() },
  });
  const [pin, setPin] = useState(\"\");");
fs.writeFileSync(path, c, "utf8");
console.log("Done");