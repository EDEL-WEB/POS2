import { useState } from "react";

export default function PasswordInput({ value, onChange, placeholder, required, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div className="password-input-wrap">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
      />
      <button type="button" className="password-toggle" onClick={() => setShow(s => !s)} tabIndex={-1}>
        {show ? "🙈" : "👁"}
      </button>
    </div>
  );
}
