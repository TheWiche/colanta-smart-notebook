import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Search, X } from '@/lib/icons';
import colors from '@/theme/colors';

interface SearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  accessibilityLabel: string;
}

/** Buscador con lupa, borde que se resalta al enfocar y botón para borrar el texto. */
export function SearchInput({ value, onChangeText, placeholder, accessibilityLabel }: SearchInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View
      className={`h-14 flex-row items-center rounded-xl border-2 bg-white px-4 shadow-sm ${
        focused ? 'border-brand' : 'border-slate-200'
      }`}
    >
      <Search size={22} color={focused ? colors.brand.DEFAULT : colors.slate[500]} strokeWidth={2.5} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        placeholderTextColor={colors.slate[500]}
        selectionColor={colors.brand.DEFAULT}
        className="ml-3 h-full flex-1 py-0 text-lg text-slate-900"
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        accessibilityLabel={accessibilityLabel}
      />
      {value.length > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Borrar búsqueda"
          onPress={() => onChangeText('')}
          hitSlop={10}
          className="ml-2 h-8 w-8 items-center justify-center rounded-full bg-slate-200 active:bg-slate-300"
        >
          <X size={18} color={colors.slate[700]} strokeWidth={3} />
        </Pressable>
      )}
    </View>
  );
}
