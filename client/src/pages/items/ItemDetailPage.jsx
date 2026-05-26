import React from "react";
import { Navigate, useParams } from "react-router-dom";

export default function ItemDetailPage() {
  const { id } = useParams();
  return <Navigate to={`/operations/items/${id}`} replace />;
}
