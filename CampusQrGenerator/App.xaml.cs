using System;
using System.Windows;
using System.Windows.Media;

namespace CampusQrGenerator
{
    public partial class App : Application
    {
        public void ToggleTheme(bool isDark)
        {
            if (isDark)
            {
                // Dark Mode Colors
                SetColorBrush("BackgroundBrush", Color.FromRgb(0x12, 0x12, 0x12));
                SetColorBrush("SidebarBrush", Color.FromRgb(0x1E, 0x1E, 0x1E));
                SetColorBrush("CardBrush", Color.FromRgb(0x24, 0x24, 0x24));
                SetColorBrush("TextPrimaryBrush", Color.FromRgb(0xE8, 0xEA, 0xED));
                SetColorBrush("TextSecondaryBrush", Color.FromRgb(0x9A, 0xA0, 0xA6));
                SetColorBrush("BorderBrush", Color.FromRgb(0x3C, 0x40, 0x43));
            }
            else
            {
                // Light Mode Colors
                SetColorBrush("BackgroundBrush", Color.FromRgb(0xFF, 0xFF, 0xFF));
                SetColorBrush("SidebarBrush", Color.FromRgb(0xF8, 0xF9, 0xFA));
                SetColorBrush("CardBrush", Color.FromRgb(0xFF, 0xFF, 0xFF));
                SetColorBrush("TextPrimaryBrush", Color.FromRgb(0x20, 0x21, 0x24));
                SetColorBrush("TextSecondaryBrush", Color.FromRgb(0x5F, 0x63, 0x68));
                SetColorBrush("BorderBrush", Color.FromRgb(0xDA, 0xDC, 0xE0));
            }
        }

        private void SetColorBrush(string key, Color color)
        {
            if (Resources.Contains(key))
            {
                Resources[key] = new SolidColorBrush(color);
            }
        }
    }
}
