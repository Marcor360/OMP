import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FirstLoginWelcomeModal } from '@/src/components/common/FirstLoginWelcomeModal';
import { MobileSideMenu } from '@/src/components/navigation/MobileSideMenu';
import { useUser } from '@/src/context/user-context';
import { useI18n } from '@/src/i18n/index';
import { useAppColors } from '@/src/styles';
import { getVisibleTabs } from '@/src/utils/permissions/permissions';

export default function TabsLayout() {
  const { uid, appUser, isSessionValid, isElder } = useUser();
  const { t } = useI18n();
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const visible = getVisibleTabs(appUser, isElder);
  const bottomInset = Math.max(insets.bottom, 10);
  const useMobileSideMenu = width < 768;
  const showTabLabels = !useMobileSideMenu;
  const tabIconSize = 22;
  const tabBarHeight = (showTabLabels ? 56 : 48) + bottomInset;
  const styles = createStyles(colors);

  const hide = (tab: string) => !visible.includes(tab as never);

  return (
    <View style={styles.root}>
      {useMobileSideMenu ? <MobileSideMenu visibleTabs={visible} /> : null}
      <View style={styles.tabsHost}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarHideOnKeyboard: true,
            tabBarStyle: {
              display: useMobileSideMenu ? 'none' : 'flex',
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
          name="preaching"
            options={{
              title: 'Predicacion',
              href: hide('preaching') ? null : undefined,
              tabBarIcon: ({ color }) => (
                <Ionicons name="document-text-outline" size={tabIconSize} color={color} />
              ),
            }}
        />
        <Tabs.Screen
          name="org-chart"
          options={{
            title: t('tabs.orgChart'),
            href: hide('org-chart') ? null : undefined,
            tabBarIcon: ({ color }) => (
              <Ionicons name="git-network-outline" size={tabIconSize} color={color} />
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
      </View>
      <FirstLoginWelcomeModal uid={uid} enabled={isSessionValid} />
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useAppColors>) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.backgroundDark,
    },
    tabsHost: {
      flex: 1,
      minHeight: 0,
    },
  });
