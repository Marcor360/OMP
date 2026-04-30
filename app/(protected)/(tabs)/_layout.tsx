import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FirstLoginWelcomeModal } from '@/src/components/common/FirstLoginWelcomeModal';
import { useUser } from '@/src/context/user-context';
import { useI18n } from '@/src/i18n/index';
import { useAppColors } from '@/src/styles';
import { getVisibleTabs } from '@/src/utils/permissions/permissions';

export default function TabsLayout() {
  const { uid, role, servicePosition, serviceDepartment, isSessionValid } = useUser();
  const { t } = useI18n();
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const visible = getVisibleTabs(role, servicePosition, serviceDepartment);
  const bottomInset = Math.max(insets.bottom, 10);
  const isCompactWeb = Platform.OS === 'web' && width < 560;
  const showTabLabels = !isCompactWeb;
  const tabIconSize = isCompactWeb ? 24 : 22;
  const tabBarHeight = (showTabLabels ? 56 : 48) + bottomInset;

  const hide = (tab: string) => !visible.includes(tab as never);

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarHideOnKeyboard: true,
          tabBarStyle: {
            backgroundColor: colors.tabBar,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            height: tabBarHeight,
            paddingTop: showTabLabels ? 8 : 6,
            paddingBottom: showTabLabels ? Math.max(bottomInset - 2, 8) : Math.max(bottomInset, 8),
          },
          tabBarShowLabel: showTabLabels,
          tabBarActiveTintColor: colors.tabActive,
          tabBarInactiveTintColor: colors.tabInactive,
          tabBarItemStyle: {
            minWidth: 0,
            paddingHorizontal: 0,
            paddingVertical: showTabLabels ? 2 : 0,
          },
          tabBarIconStyle: {
            marginTop: showTabLabels ? 0 : 2,
          },
          tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginBottom: 2 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t('tabs.home'),
            tabBarIcon: ({ color }) => (
              <Ionicons name="home-outline" size={tabIconSize} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="meetings"
          options={{
            title: t('tabs.meetings'),
            href: hide('meetings') ? null : undefined,
            tabBarIcon: ({ color }) => (
              <Ionicons name="calendar-outline" size={tabIconSize} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="assignments"
          options={{
            title: t('tabs.assignments'),
            href: hide('assignments') ? null : undefined,
            tabBarIcon: ({ color }) => (
              <Ionicons name="checkmark-done-outline" size={tabIconSize} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="users"
          options={{
            title: t('tabs.users'),
            href: hide('users') ? null : undefined,
            tabBarIcon: ({ color }) => (
              <Ionicons name="people-outline" size={tabIconSize} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="cleaning"
          options={{
            title: t('tabs.cleaning'),
            href: hide('cleaning') ? null : undefined,
            tabBarIcon: ({ color }) => (
              <Ionicons name="sparkles-outline" size={tabIconSize} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: t('tabs.profile'),
            href: hide('profile') ? null : undefined,
            tabBarIcon: ({ color }) => (
              <Ionicons name="person-outline" size={tabIconSize} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: t('tabs.settings'),
            href: hide('settings') ? null : undefined,
            tabBarIcon: ({ color }) => (
              <Ionicons name="settings-outline" size={tabIconSize} color={color} />
            ),
          }}
        />
      </Tabs>
      <FirstLoginWelcomeModal uid={uid} enabled={isSessionValid} />
    </>
  );
}
