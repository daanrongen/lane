import type { Project } from "@/domain/projects.ts";
import { projectName } from "@/domain/projects.ts";
import { Row } from "@/ui/atoms/Box.tsx";
import { Text } from "@/ui/atoms/Text.tsx";
import { useMetrics } from "@/ui/lib/context.ts";

export const ProjectHeading = ({ project }: { project: Project }) => {
  const r = useMetrics();
  return (
    <Row
      gap={r.dot}
      style={{
        paddingLeft: Math.round(r.pad / 2),
        paddingTop: Math.round(r.pad / 2),
      }}
    >
      <Text size="small">{projectName(project.cwd)}</Text>
      <Text size="small" tone="dim">
        {String(project.sessions.length)}
      </Text>
    </Row>
  );
};
