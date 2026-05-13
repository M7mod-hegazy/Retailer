import React from "react";

export default function SectionHero({
  eyebrow,
  title,
  description,
  icon: Icon,
  stats = [],
  action = null,
}) {
  return (
    <section className="section-hero">
      <div className="section-hero__content">
        {eyebrow ? <div className="section-hero__eyebrow">{eyebrow}</div> : null}
        <div className="section-hero__headline">
          {Icon ? (
            <div className="section-hero__icon">
              <Icon className="h-6 w-6" />
            </div>
          ) : null}
          <div>
            <h1 className="section-hero__title">{title}</h1>
            {description ? <p className="section-hero__description">{description}</p> : null}
          </div>
        </div>
      </div>

      <div className="section-hero__aside">
        {stats.length ? (
          <div className="section-hero__stats">
            {stats.map((stat) => (
              <div key={stat.label} className="section-hero__stat">
                <div className="section-hero__stat-label">{stat.label}</div>
                <div className="section-hero__stat-value">{stat.value}</div>
              </div>
            ))}
          </div>
        ) : null}
        {action}
      </div>
    </section>
  );
}
