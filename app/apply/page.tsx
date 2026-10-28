import { AuthShell } from "@/components/auth-shell";
import { ApplyForm } from "./apply-form";

export const metadata = { title: "Become a Real Care provider" };

export default function ApplyPage() {
  return (
    <AuthShell
      title="Become a provider"
      subtitle={
        <>
          <p>Tell us a little about you and Real Care staff will get in touch.</p>
          <p>Cuéntenos un poco sobre usted y el personal de Real Care se comunicará con usted.</p>
        </>
      }
    >
      <ApplyForm />
    </AuthShell>
  );
}
