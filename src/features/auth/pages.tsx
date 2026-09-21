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
import { WorkloggerLogo } from "../../components/brand";

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

function BrandMark() {
  return (
    <span className="inline-flex flex-col gap-1">
      <WorkloggerLogo className="h-12 w-auto" />
      <span className="text-xs text-muted">Task Management</span>
    </span>
  );
}

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
    <div className="min-h-dvh flex items-center justify-center px-3 py-10">
      <div className="mx-auto w-full max-w-4xl grid gap-12 md:gap-16 md:grid-cols-[1fr_380px] md:items-center">
      <div className="order-1 md:order-2">
        <div className="md:hidden mb-4">
          <BrandMark />
        </div>
        <form
          className="card p-5 shadow-lg shadow-black/30"
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
          <h1 className="text-base font-semibold">Welcome back</h1>
          <p className="text-xs text-muted mt-0.5 mb-4">Log in to continue to Worklogger.</p>
          <Field label="Email" error={formState.errors.email?.message}>
            <Input type="email" autoComplete="email" placeholder="you@example.com" {...register("email")} />
          </Field>
          <Field label="Password" error={formState.errors.password?.message}>
            <PasswordInput
              autoComplete="current-password"
              placeholder="Your password"
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
        <p className="text-sm text-muted mt-3 text-center md:text-left">
          No account? <Link to="/register">Register</Link>
        </p>
      </div>
      <div className="order-2 md:order-1">
        <div className="hidden md:block mb-4">
          <BrandMark />
        </div>
        <h2 className="text-xl font-semibold tracking-tight leading-snug">
          Tasks by space, with the month-end record kept.
        </h2>
        <p className="text-sm text-muted mt-2 leading-relaxed border-l-2 border-accent/60 pl-3">
          Log in to see what is assigned to you, what is blocked or overdue,
          and what each space completed this month.
        </p>
      </div>
      </div>
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
      <div className="min-h-dvh flex items-center justify-center px-3 py-10">
      <div className="mx-auto w-full max-w-sm flex flex-col justify-center">
        <div className="flex flex-col items-center gap-1">
          <WorkloggerLogo className="h-9 w-auto" />
          <p className="text-sm text-muted">Task Management</p>
        </div>
        <h1 className="text-lg font-semibold text-center mt-4">
          Check your email
        </h1>
        <div className="card p-4 mt-4 shadow-lg shadow-black/30" role="status">
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
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-3 py-10">
      <div className="mx-auto w-full max-w-4xl grid gap-12 md:gap-16 md:grid-cols-[1fr_380px] md:items-center">
      <div className="order-1 md:order-2">
        <div className="md:hidden mb-4">
          <BrandMark />
        </div>
        <form
          className="card p-5 shadow-lg shadow-black/30"
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
          <h1 className="text-base font-semibold">Create your account</h1>
          <p className="text-xs text-muted mt-0.5 mb-4">One account for every space you join or create.</p>
          <Field
            label="Display name"
            error={formState.errors.displayName?.message}
          >
            <Input autoComplete="name" placeholder="How teammates see you" {...register("displayName")} />
          </Field>
          <Field label="Email" error={formState.errors.email?.message}>
            <Input type="email" autoComplete="email" placeholder="you@example.com" {...register("email")} />
          </Field>
          <Field
            label="Password (min 8 characters)"
            error={formState.errors.password?.message}
          >
            <PasswordInput
              autoComplete="new-password"
              placeholder="At least 8 characters"
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
        <p className="text-sm text-muted mt-3 text-center md:text-left">
          Have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
      <div className="order-2 md:order-1">
        <div className="hidden md:block mb-4">
          <BrandMark />
        </div>
        <h2 className="text-xl font-semibold tracking-tight leading-snug">
          Create an account to start a space or join one.
        </h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="border-l-2 border-accent/60 pl-3">
            <dt className="font-medium">Set up a space with your own workflow</dt>
            <dd className="text-muted mt-0.5">
              Name, short prefix such as DEV, and timezone. Define the statuses
              your work moves through.
            </dd>
          </div>
          <div className="border-l-2 border-accent/60 pl-3">
            <dt className="font-medium">Track assignments you can find again</dt>
            <dd className="text-muted mt-0.5">
              Stable keys like DEV-001, blocked and overdue flags, branch and
              PR fields, and filtered views you can share by link.
            </dd>
          </div>
          <div className="border-l-2 border-accent/60 pl-3">
            <dt className="font-medium">Keep a monthly snapshot per space</dt>
            <dd className="text-muted mt-0.5">
              Pick a month, generate the report, then regenerate or print it to
              PDF when you need it.
            </dd>
          </div>
        </dl>
        <div className="mt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
            What happens after
          </h3>
          <ol className="mt-2 space-y-1.5 text-sm text-muted list-decimal list-inside">
            <li>You land on Overview. Create a space, or open Invitations if a teammate invited this email.</li>
            <li>If email confirmation is on, verify from your inbox first, then log in.</li>
          </ol>
        </div>
      </div>
      </div>
    </div>
  );
}
