import React from "react";

export function Card({ children, className = "", elevated = false, inset = false }) {
  let cardClass = "card";
  if (elevated) cardClass = "card-elevated";
  else if (inset) cardClass = "card-inset";
  
  return <div className={`${cardClass} p-4 ${className}`.trim()}>{children}</div>;
}

export default Card;