import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignUpForm from "../../components/auth/SignUpForm";

export default function SignUp() {
  return (
    <>
      <PageMeta
        title="Sign Up | Sustainability Signals"
        description="Sign Up page for Sustainability Signals"
      />
      <AuthLayout>
        <SignUpForm />
      </AuthLayout>
    </>
  );
}
