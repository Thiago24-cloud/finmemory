pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        // Stone SDK (PackageCloud) — descomente após credenciais em local.properties:
        // maven { url = uri("https://packagecloud.io/priv/${extra["stonePackageCloudToken"]}/stone/pos-android/maven2") }
    }
}

rootProject.name = "FinMemoryRetailer"
include(":app")
