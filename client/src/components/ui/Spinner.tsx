interface SpinnerProps {
  label?: string;
  large?: boolean;
}

export function Spinner({ label = "Loading", large = false }: SpinnerProps) {
  return (
    <span
      className={`spinner${large ? " spinner--lg" : ""}`}
      role="status"
      aria-label={label}
    />
  );
}
