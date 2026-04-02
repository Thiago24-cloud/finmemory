FinMemory iOS — CocoaPods (Capacitor + ML Kit barcode)

O projeto iOS usa CocoaPods (não Swift Package Manager) para integrar
@capacitor-mlkit/barcode-scanning com Google ML Kit.

No Mac, após clonar o repositório:

  cd ios/App
  pod install

Depois abra sempre o workspace:

  ios/App/App.xcworkspace

Não abra apenas App.xcodeproj — sem o workspace os Pods não entram no build.

Requisitos: Xcode, CocoaPods (gem install cocoapods), Ruby.
