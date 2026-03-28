/**
 * Tab bar icon using Ionicons line/filled variants.
 * Outline style when inactive, filled when active — calm and consistent.
 */
import React from 'react';
import Icon from 'react-native-vector-icons/Ionicons';

interface TabBarIconProps {
  name: string;        // base Ionicons name, e.g. "home"
  focused: boolean;
  color: string;
  size?: number;
}

export function TabBarIcon({name, focused, color, size = 24}: TabBarIconProps) {
  // Ionicons convention: filled = "home", outline = "home-outline"
  const iconName = focused ? name : `${name}-outline`;
  return <Icon name={iconName} size={size} color={color} />;
}
