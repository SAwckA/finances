import type { ReactNode } from "react";
import { Card, CardBody, CardFooter, CardHeader } from "@heroui/react";

type UiSurfaceCardProps = {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  className?: string;
  bodyClassName?: string;
};

export function UiSurfaceCard({ children, header, footer, className, bodyClassName }: UiSurfaceCardProps) {
  return (
    <Card className={`app-panel shadow-none ${className ?? ""}`.trim()}>
      {header ? <CardHeader>{header}</CardHeader> : null}
      <CardBody className={bodyClassName}>{children}</CardBody>
      {footer ? <CardFooter>{footer}</CardFooter> : null}
    </Card>
  );
}
