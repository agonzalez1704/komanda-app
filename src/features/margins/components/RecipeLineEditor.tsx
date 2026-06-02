import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, IconButton, Text, TextField } from '@/components/ui';
import { color, space } from '@/theme/tokens';
import { formatMXN } from '@/domain/money';
import type {
  IngredientRowT,
  ProductRecipeLineRowT,
} from '@/insforge/schemas';

export type RecipeLineDraft = {
  ingredientId: string;
  quantity: number;
};

export type RecipeLineEditorProps = {
  lines: ProductRecipeLineRowT[];
  ingredients: IngredientRowT[];
  onAdd: (draft: RecipeLineDraft) => void;
  onDelete: (lineId: string) => void;
  busy?: boolean;
};

/**
 * Recipe editor. Shows existing lines (delete-only) and an inline add form.
 * Editing an existing line is intentionally not supported in v1 — delete +
 * re-add keeps the data path simple.
 */
export function RecipeLineEditor({
  lines,
  ingredients,
  onAdd,
  onDelete,
  busy,
}: RecipeLineEditorProps) {
  const [ingredientId, setIngredientId] = useState<string>('');
  const [qtyText, setQtyText] = useState('');

  const ingredientsById = useMemo(
    () => new Map(ingredients.map((i) => [i.id, i])),
    [ingredients]
  );

  // Filter out ingredients already used in this recipe to enforce the
  // (product_id, ingredient_id) uniqueness constraint at the UI level.
  const availableIngredients = useMemo(() => {
    const used = new Set(lines.map((l) => l.ingredient_id));
    return ingredients.filter((i) => i.active && !used.has(i.id));
  }, [ingredients, lines]);

  function handleAdd() {
    const qty = Number(qtyText.replace(',', '.'));
    if (!ingredientId || !Number.isFinite(qty) || qty <= 0) return;
    onAdd({ ingredientId, quantity: qty });
    setIngredientId('');
    setQtyText('');
  }

  return (
    <Card style={styles.card}>
      <Text variant="h3">Recipe</Text>

      {lines.length === 0 ? (
        <Text variant="bodySm">
          No recipe lines yet. Add the ingredients used per portion below.
        </Text>
      ) : (
        <View style={styles.list}>
          {lines.map((line) => {
            const ing = ingredientsById.get(line.ingredient_id);
            const lineCost = ing
              ? Math.round(ing.cost_cents_per_unit * line.quantity)
              : null;
            return (
              <View key={line.id} style={styles.line}>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">{ing?.name ?? '⚠ Unknown'}</Text>
                  <Text variant="footnote">
                    {line.quantity} {ing?.unit ?? ''}
                    {lineCost != null ? ` · ${formatMXN(lineCost)}` : ''}
                  </Text>
                </View>
                <IconButton
                  name="trash-outline"
                  accessibilityLabel={`Remove ${ing?.name ?? 'line'}`}
                  onPress={() => onDelete(line.id)}
                  disabled={busy}
                  tint={color.danger}
                />
              </View>
            );
          })}
        </View>
      )}

      {availableIngredients.length === 0 ? (
        <Text variant="footnote">
          All ingredients in your catalog are already used here. Add a new
          ingredient to extend the recipe.
        </Text>
      ) : (
        <View style={styles.addBlock}>
          <Text variant="label">Add line</Text>
          <View style={styles.pickerList}>
            {availableIngredients.map((ing) => {
              const selected = ing.id === ingredientId;
              return (
                <Pressable
                  key={ing.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={ing.name}
                  onPress={() => setIngredientId(ing.id)}
                  style={({ pressed }) => [
                    styles.pickerItem,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Ionicons
                    name={selected ? 'radio-button-on' : 'radio-button-off'}
                    size={16}
                    color={selected ? color.primary : color.textTertiary}
                  />
                  <Text variant="bodyStrong">{ing.name}</Text>
                  <Text variant="footnote">
                    {' '}· {formatMXN(Math.round(ing.cost_cents_per_unit))}/{ing.unit}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <TextField
            label="Quantity"
            keyboardType="decimal-pad"
            value={qtyText}
            onChangeText={setQtyText}
            placeholder="e.g. 22.5"
          />
          <Button
            label="Add ingredient"
            onPress={handleAdd}
            disabled={busy || !ingredientId || !qtyText}
            loading={busy}
          />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.sm,
  },
  list: {
    gap: space.xs,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.xs,
  },
  addBlock: {
    gap: space.sm,
    marginTop: space.sm,
  },
  pickerList: {
    gap: space.xs,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space.xs,
  },
});
