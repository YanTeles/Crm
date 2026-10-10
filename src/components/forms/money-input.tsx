"use client";

import { useState } from "react";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { parseMoney } from "@/lib/format";

// Campo monetário em BRL. Emite número (2 casas) ou null quando inválido/vazio.
export function MoneyInput({
  id,
  value,
  onChange,
  invalid,
  autoFocus,
}: {
  id?: string;
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  invalid?: boolean;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState(() =>
    value === null || value === undefined ? "" : value.toFixed(2).replace(".", ","),
  );
  return (
    <InputGroup>
      <InputGroupAddon>
        <InputGroupText>R$</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput
        id={id}
        inputMode="decimal"
        autoComplete="off"
        placeholder="0,00"
        value={text}
        autoFocus={autoFocus}
        aria-invalid={invalid}
        onChange={(e) => {
          const t = e.target.value.replace(/[^\d.,]/g, "");
          setText(t);
          onChange(parseMoney(t));
        }}
      />
    </InputGroup>
  );
}
