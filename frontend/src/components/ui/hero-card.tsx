import type { ReactNode } from "react";
import { Card, CardBody, CardHeader, CardFooter } from "@heroui/react";

type HeroCardProps = {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  className?: string;
  bodyClassName?: string;
};

export function HeroCard({ children, header, footer, className, bodyClassName }: HeroCardProps) {
  return (
    <Card className={className} shadow="sm">
      {header ? <CardHeader>{header}</CardHeader> : null}
      <CardBody className={bodyClassName}>{children}</CardBody>
      {footer ? <CardFooter>{footer}</CardFooter> : null}
    </Card>
  );
}
