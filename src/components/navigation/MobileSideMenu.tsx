import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '@/src/i18n/index';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';

type TabName =
  | 'index'
  | 'meetings'
  | 'assignments'
  | 'preaching'
  | 'org-chart'
  | 'users'
  | 'cleaning'
  | 'profile'
  | 'settings';

interface MobileSideMenuProps {
  visibleTabs: TabName[];
}

const getTabIcon = (tab: TabName): keyof typeof Ionicons.glyphMap => {
  switch (tab) {
    case 'index':
      return 'home-outline';
    case 'meetings':
      return 'calendar-outline';
    case 'assignments':
      return 'checkmark-done-outline';
    case 'preaching':
      return 'document-text-outline';
    case 'org-chart':
      return 'git-network-outline';
    case 'users':
      return 'people-outline';
    case 'cleaning':
      return 'sparkles-outline';
    case 'profile':
      return 'person-outline';
    case 'settings':
      return 'settings-outline';
  }
};

const getTabHref = (tab: TabName) =>
  tab === 'index' ? '/(protected)/(tabs)/' : `/(protected)/(tabs)/${tab}`;

export function MobileSideMenu({ visibleTabs }: MobileSideMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [isOpen, setIsOpen] = useState(false);
  const drawerWidth = Math.min(Math.max(Math.round(width * 0.5), 180), 280);
  const slideX = useRef(new Animated.Value(-drawerWidth)).current;
  const styles = useMemo(
    () => createStyles(colors, insets.top, insets.bottom, drawerWidth),
    [colors, drawerWidth, insets.bottom, insets.top]
  );

  useEffect(() => {
    if (!isOpen) {
      slideX.setValue(-drawerWidth);
      return;
    }

    Animated.timing(slideX, {
      toValue: 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [drawerWidth, isOpen, slideX]);

  const openMenu = () => {
    slideX.setValue(-drawerWidth);
    setIsOpen(true);
  };

  const closeMenu = () => {
    Animated.timing(slideX, {
      toValue: -drawerWidth,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => setIsOpen(false));
  };

  const items = useMemo(
    () =>
      visibleTabs.map((tab) => ({
        tab,
        href: getTabHref(tab),
        icon: getTabIcon(tab),
        label:
          tab === 'preaching'
            ? 'Predicacion'
            : tab === 'org-chart'
              ? t('tabs.orgChart')
              : t(`tabs.${tab === 'index' ? 'home' : tab}`),
      })),
    [t, visibleTabs]
  );

  const handleNavigate = (href: string) => {
    closeMenu();
    router.push(href as never);
  };

  return (
    <>
      <View style={styles.topBar}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Abrir menu"
          activeOpacity={0.8}
          onPress={openMenu}
          style={styles.menuButton}
        >
          <Ionicons name="menu-outline" size={26} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.topBarText}>
          <Text style={styles.topBarTitle}>OMP</Text>
          <Text style={styles.topBarSubtitle}>Menu</Text>
        </View>
      </View>

      <Modal
        animationType="fade"
        transparent
        visible={isOpen}
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={closeMenu}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={closeMenu} />
          <Animated.View style={[styles.drawer, { transform: [{ translateX: slideX }] }]}>
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerTitle}>OMP</Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Cerrar menu"
                activeOpacity={0.8}
                onPress={closeMenu}
                style={styles.closeButton}
              >
                <Ionicons name="close-outline" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.menuList}
              showsVerticalScrollIndicator={false}
            >
              {items.map((item) => {
                const isActive =
                  item.tab === 'index'
                    ? pathname === '/' || pathname.endsWith('/(tabs)') || pathname.endsWith('/(tabs)/')
                    : pathname.includes(`/${item.tab}`);

                return (
                  <TouchableOpacity
                    key={item.tab}
                    accessibilityRole="button"
                    activeOpacity={0.78}
                    onPress={() => handleNavigate(item.href)}
                    style={[styles.menuItem, isActive && styles.menuItemActive]}
                  >
                    <Ionicons
                      name={item.icon}
                      size={22}
                      color={isActive ? colors.onPrimary : colors.textSecondary}
                    />
                    <Text style={[styles.menuItemText, isActive && styles.menuItemTextActive]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const createStyles = (
  colors: AppColorSet,
  topInset: number,
  bottomInset: number,
  drawerWidth: number
) => {
  return StyleSheet.create({
    menuButton: {
      width: 48,
      height: 48,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.16,
      shadowRadius: 12,
      elevation: 8,
    },
    topBar: {
      minHeight: 68,
      paddingTop: Math.max(topInset, 0),
      paddingHorizontal: 16,
      paddingBottom: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.backgroundDark,
    },
    topBarText: {
      flex: 1,
      minWidth: 0,
    },
    topBarTitle: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: '900',
    },
    topBarSubtitle: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
      marginTop: 1,
    },
    modalRoot: {
      flex: 1,
      flexDirection: 'row',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay,
    },
    drawer: {
      width: drawerWidth,
      minWidth: 180,
      maxWidth: 280,
      paddingTop: Math.max(topInset + 18, 28),
      paddingBottom: Math.max(bottomInset, 12) + 16,
      paddingHorizontal: 12,
      backgroundColor: colors.surface,
      borderRightWidth: 1,
      borderRightColor: colors.border,
      shadowColor: '#000000',
      shadowOffset: { width: 8, height: 0 },
      shadowOpacity: 0.2,
      shadowRadius: 18,
      elevation: 12,
    },
    drawerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 18,
      paddingHorizontal: 4,
    },
    drawerTitle: {
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: '900',
    },
    closeButton: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceRaised,
    },
    menuList: {
      gap: 8,
      paddingBottom: 8,
    },
    menuItem: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 10,
      borderRadius: 12,
    },
    menuItemActive: {
      backgroundColor: colors.primary,
    },
    menuItemText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '800',
    },
    menuItemTextActive: {
      color: colors.onPrimary,
    },
  });
};
