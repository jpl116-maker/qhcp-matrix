import { createFileRoute } from "@tanstack/react-router";
import { QhcpMatrix } from "@/components/qhcp-matrix";

export const Route = createFileRoute("/")({ component: QhcpMatrix });
