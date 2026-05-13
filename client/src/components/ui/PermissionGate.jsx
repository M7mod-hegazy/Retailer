import React, { useState } from "react";
import { usePermission } from "../../hooks/usePermission";
import PermissionDeniedModal from "./PermissionDeniedModal";

export default function PermissionGate({ page, action, children }) {
  const [denied, setDenied] = useState(false);
  const permitted = usePermission(page, action);

  const child = React.Children.only(children);

  const wrappedChild = React.cloneElement(child, {
    onClick: (e) => {
      if (permitted) {
        child.props.onClick?.(e);
      } else {
        e.preventDefault();
        e.stopPropagation();
        setDenied(true);
      }
    },
  });

  return (
    <>
      {wrappedChild}
      <PermissionDeniedModal open={denied} onClose={() => setDenied(false)} />
    </>
  );
}
