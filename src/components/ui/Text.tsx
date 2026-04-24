import { Text as RNText, type TextProps as RNTextProps, StyleSheet } from 'react-native';
import { text as tokens } from '@/theme/tokens';

type Variant =
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'body'
  | 'bodyStrong'
  | 'bodySm'
  | 'footnote'
  | 'label'
  | 'caption';

export type TextProps = RNTextProps & {
  variant?: Variant;
  /** Override color (expects a token color string). */
  color?: string;
  mono?: boolean;
  align?: 'left' | 'center' | 'right';
};

export function Text({
  variant = 'body',
  color,
  mono,
  align,
  style,
  ...rest
}: TextProps) {
  return (
    <RNText
      {...rest}
      style={[
        tokens[variant],
        mono && tokens.mono,
        color ? { color } : null,
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}

// Exported helper so other components can compose style objects directly.
export const textStyle = StyleSheet.create(tokens as any);
