"use client";

import * as React from "react";
import { heroNotifications } from "@/data/marketing-content";
import { HeroNotificationPill } from "@/components/ui/hero-notification-pill";
import { usePrefersReducedMotion } from "@/components/motion";

export function NotificationWheel() {
  const reduceMotion = usePrefersReducedMotion();
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    if (reduceMotion) {
      return;
    }

    const interval = window.setInterval(() => {
      setIndex((current) => (current + 1) % heroNotifications.length);
    }, 2600);

    return () => window.clearInterval(interval);
  }, [reduceMotion]);

  if (reduceMotion) {
    return (
      <div className="grid gap-3">
        {heroNotifications.slice(0, 2).map((item) => {
          const Icon = item.icon;
          return (
            <HeroNotificationPill
              key={item.title}
              title={item.title}
              detail={item.detail}
              status={item.status}
              icon={<Icon aria-hidden="true" />}
            />
          );
        })}
      </div>
    );
  }

  const item = heroNotifications[index];
  const Icon = item.icon;

  return (
    <div className="grid gap-3 [grid-template-rows:1fr] animate-[notif-slide_220ms_ease-out]">
      <HeroNotificationPill
        key={item.title}
        className="animate-[notif-wheel-in_360ms_ease-out]"
        title={item.title}
        detail={item.detail}
        status={item.status}
        icon={<Icon aria-hidden="true" />}
      />
    </div>
  );
}

