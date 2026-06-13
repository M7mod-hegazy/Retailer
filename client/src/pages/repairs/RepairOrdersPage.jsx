import React, { lazy } from "react";
import { Routes, Route } from "react-router-dom";
import FeatureRoute from "../../components/ui/FeatureRoute";

const RepairOrdersList = lazy(() => import("./RepairOrdersList"));
const RepairOrderForm = lazy(() => import("./RepairOrderForm"));
const RepairOrderDetail = lazy(() => import("./RepairOrderDetail"));

export default function RepairOrdersPage() {
  return (
    <FeatureRoute featureKey="feature_repair_orders">
      <Routes>
        <Route index element={<RepairOrdersList />} />
        <Route path="new" element={<RepairOrderForm />} />
        <Route path=":id" element={<RepairOrderDetail />} />
        <Route path=":id/edit" element={<RepairOrderForm />} />
      </Routes>
    </FeatureRoute>
  );
}
