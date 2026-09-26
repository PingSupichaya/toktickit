export interface PasswordRuleState {
  met: boolean;
  label: string;
}

interface PasswordStrengthListProps {
  rules: PasswordRuleState[];
}

export function PasswordStrengthList({ rules }: PasswordStrengthListProps) {
  return (
    <ul className="password-rules">
      {rules.map((rule, index) => (
        <li
          key={index}
          data-testid={`password-rule-${index + 1}`}
          className={`password-rules__item${rule.met ? " is-met" : ""}`}
        >
          <span className="password-rules__mark" aria-hidden="true">
            {rule.met ? "\u2713" : "\u2022"}
          </span>
          {rule.label}
        </li>
      ))}
    </ul>
  );
}