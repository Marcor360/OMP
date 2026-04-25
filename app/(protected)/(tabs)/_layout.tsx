import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useUser } from '@/src/context/user-context';
import { useI18n } from '@/src/i18n/index';
import { useAppColors } from '@/src/styles';
import { getVisibleTabs } from '@/src/utils/permissions/permissions';

export default function TabsLayout() {
  const { role, servicePosition, serviceDepartment } = useUser();
  const { t } = useI18n();
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const visible = getVisibleTabs(role, servicePosition, serviceDepartment);
  const bottomInset = Math.max(insets.bottom, 10);
  const tabBarHeight = 56 + bottomInset;

  const hide = (tab: string) => !visible.includes(tab as never);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingTop: 8,
          paddingBottom: Math.max(bottomInset - 2, 8),
        },
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarItemStyle: {
          paddingVertical: 2,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginBottom: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="meetings"
        options={{
          title: t('tabs.meetings'),
          href: hide('meetings') ? null : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="assignments"
        options={{
          title: t('tabs.assignments'),
          href: hide('assignments') ? null : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="checkmark-done-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: t('tabs.users'),
          href: hide('users') ? null : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="cleaning"
        options={{
          title: t('tabs.cleaning'),
          href: hide('cleaning') ? null : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="sparkles-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          href: hide('profile') ? null : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          href: hide('settings') ? null : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
