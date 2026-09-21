import { forwardRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  loginSchema,
  registerSchema,
  type LoginInput,
  type RegisterInput,
} from "../../lib/schemas";
import { useAuth } from "../../lib/auth";
import { Button, Field, Input } from "../../components/ui";

const PasswordInput = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function PasswordInput({ ...props }, ref) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input ref={ref} type={show ? "text" : "password"} {...props} />
      <button
        type="button"
        className="absolute right-1 top-1/2 -translate-y-1/2 text-xs text-muted hover:text-white px-2 py-1"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? "Hide" : "Show"}
      </button>
    </div>
  );
});

export function LoginPage() {
  const { signIn, resendConfirmation } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const [serverError, setServerError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  const { register, handleSubmit, formState, getValues } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  return (
    <div className="mx-auto max-w-sm px-3 py-10 min-h-[70dvh] flex flex-col justify-center">
      <div className="text-center mb-4">
        <p className="text-2xl font-bold tracking-tight">nalds</p>
        <p className="text-sm text-muted">Task Management</p>
      </div>
      <form
        className="card p-4 mt-4"
        onSubmit={handleSubmit(async (v) => {
          setServerError(null);
          setNeedsConfirmation(false);
          setResendMsg(null);
          const { error, emailNotConfirmed } = await signIn(
            v.email,
            v.password,
          );
          if (error) {
            setServerError(error);
            if (emailNotConfirmed) setNeedsConfirmation(true);
          } else nav(loc.state?.from ?? "/overview", { replace: true });
        })}
      >
        <Field label="Email" error={formState.errors.email?.message}>
          <Input type="email" autoComplete="email" {...register("email")} />
        </Field>
        <Field label="Password" error={formState.errors.password?.message}>
          <PasswordInput
            autoComplete="current-password"
            {...register("password")}
          />
        </Field>
        {serverError && (
          <p className="error-text" role="alert">
            {serverError}
          </p>
        )}
        {needsConfirmation && (
          <p className="text-xs text-muted mt-2">
            Didn&apos;t get the email?{" "}
            <button
              type="button"
              className="underline hover:text-white"
              onClick={async () => {
                setResendMsg(null);
                const { error } = await resendConfirmation(getValues("email"));
                setResendMsg(
                  error ??
                    "Verification email resent. Please check your inbox (and spam folder).",
                );
              }}
            >
              Resend verification email
            </button>
            {resendMsg && (
              <span className="block mt-1" role="status">
                {resendMsg}
              </span>
            )}
          </p>
        )}
        <Button
          variant="primary"
          className="w-full mt-2"
          disabled={formState.isSubmitting}
        >
          {formState.isSubmitting ? "Logging in…" : "Log in"}
        </Button>
      </form>
      <p className="text-sm text-muted mt-3">
        No account? <Link to="/register">Register</Link>
      </p>
    </div>
  );
}

export function RegisterPage() {
  const { signUp, resendConfirmation } = useAuth();
  const nav = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  if (pendingEmail) {
    return (
      <div className="mx-auto max-w-sm px-3 py-10 min-h-[70dvh] flex flex-col justify-center">
        <div className="text-center">
          <p className="text-2xl font-bold tracking-tight">nalds</p>
          <p className="text-sm text-muted">Task Management</p>
        </div>
        <h1 className="text-lg font-semibold text-center mt-4">
          Check your email
        </h1>
        <div className="card p-4 mt-4" role="status">
          <p className="text-sm">
            Account created for <strong>{pendingEmail}</strong>. Waiting for
            email confirmation — please check your inbox and click the
            verification link to verify your email address.
          </p>
          <p className="text-xs text-muted mt-2">
            After verifying, log in below. Don&apos;t forget to check your spam
            folder.
          </p>
          {resendMsg && (
            <p className="text-xs mt-2" role="status">
              {resendMsg}
            </p>
          )}
          <div className="flex gap-2 mt-3">
            <Button
              onClick={async () => {
                setResendMsg(null);
                const { error } = await resendConfirmation(pendingEmail);
                setResendMsg(
                  error ??
                    "Verification email resent. Please check your inbox.",
                );
              }}
            >
              Resend email
            </Button>
            <Button variant="primary" onClick={() => nav("/login")}>
              Go to log in
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm px-3 py-10 min-h-[70dvh] flex flex-col justify-center">
      <div className="text-center mb-4">
        <p className="text-2xl font-bold tracking-tight">nalds</p>
        <p className="text-sm text-muted">Task Management</p>
      </div>
      <form
        className="card p-4 mt-4"
        onSubmit={handleSubmit(async (v) => {
          setServerError(null);
          const { error, confirmationRequired } = await signUp(
            v.displayName,
            v.email,
            v.password,
          );
          if (error) setServerError(error);
          else if (confirmationRequired) setPendingEmail(v.email.trim());
          else nav("/overview", { replace: true });
        })}
      >
        <Field
          label="Display name"
          error={formState.errors.displayName?.message}
        >
          <Input autoComplete="name" {...register("displayName")} />
        </Field>
        <Field label="Email" error={formState.errors.email?.message}>
          <Input type="email" autoComplete="email" {...register("email")} />
        </Field>
        <Field
          label="Password (min 8 characters)"
          error={formState.errors.password?.message}
        >
          <PasswordInput
            autoComplete="new-password"
            {...register("password")}
          />
        </Field>
        {serverError && (
          <p className="error-text" role="alert">
            {serverError}
          </p>
        )}
        <Button
          variant="primary"
          className="w-full mt-2"
          disabled={formState.isSubmitting}
        >
          {formState.isSubmitting ? "Creating…" : "Register"}
        </Button>
      </form>
      <p className="text-sm text-muted mt-3">
        Have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}
