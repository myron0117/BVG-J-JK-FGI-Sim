**Drücke [hier](README-en.md) um die deutsche Version dieser README anzuzeigen.**

# Series J/JK PIS-Simulator

A true-to-the-original replica of the passenger information system of the new series J and JK trains of the Berlin subway.

For download, suitable versions are available at the [releases](https://github.com/myron0117/BVG-J-JK-FGI-Sim/releases) of this repository.



## Abschnitte:

- [Usage](#usage)\
-> [Controls](#controls)\
-> [Configuration & Appearance](#configuration--appearance)\
-> [Available Lines](#available-lines)\
-> [Remote Control](#remote-control)



## Usage

> [!IMPORTANT]
> The Simulator is to be started through the Batch file `Baureihe J&JK FGI-Simulator.bat` at the core directory.

> [!NOTE]
> The Simulator was designed for 16:9-FHD-Monitors. For best visibility of all elements, please run the browser the Simulator is running in at fullscreen.

The user interface is designed for a good overview and easy use. The input of data is self-explanatory, the station IDs can be viewed through the button **'Show Station ID Lists'**.

Additionally, both monitors can be popped out into new tabs with the currently set configuration.

Buttons for control aswell as configuration of the Simulator are explained below.



### Controls

| Button | Function |
| ------------- | ------------- |
| ↓  | Forwards by one station. A jingle plays after 5s and the direction display is updated. With **Shift + Click** you can forward without further automatic action. |
| ↑ | Backwards by one station. |
| short before stop | Simulates the point where the vehicle arrives at a station. The exits overview appears and the direction display is being supplemented with an exit side arrow. |
| door release | Simulates the point where the doors are released at standstill. The exits overview and potentionally the real-time connections overview disappear after 10s. |
| dispatch | Simulates the withdrawal of the door release. It is now possible to forward. |



### Configuration & Appearance

| Configuration Element | Function |
| ------------- | ------------- |
| Display Side | Determines the simulated side on which the monitor is placed. Affects the displayed direction of the line rundown and whether the exits overview shows at arrival. |
| Display Position | Determines the simulated position within the vehicle. Affects the displayed exits and connection possibilities, which are displayed at different spots depending on the position. |
| Appearance | Self-explanatory. Affects all displays. |
| Always Show Exit Overview? | Determines if the exits overview should also show on the side that doesn't equal to the exit side. |
| Show Live Connections? | Self-explanatory; appears 15s after forwarding. Affects all displays. |
| Combined Line Design | Determines the color design of multi-colored lines, such as the U12. Affects all displays. |
| Fallback Layer | Self-explanatory. |

The language setting in the top right corner is part of the configuration and can, like all other settings, be saved through the button **'save configuration'**.



### Available Lines

In the following table, all available lines are listed along with a short description.

| Displayed Line Desig. | Entered Line Desig. | Description |
| ------------- | ------------- | ------------- |
| **U1 - U9** | `U1` `U2` `U3` `U4` `U5` `U6` `U7` `U8` `U9` | Default lines. |
| **U2** | `U2+` | Fictional extension to Rathaus Spandau. |
| **U3** | `U3+` | Fictional extension to Mexikoplatz. |
| **U5** | `U5+` | Fictional extension to Urban Tech Republic, based on fictional U55 from U-Bahn Sim Berlin's Trainz Simulator 2009 Add-On. |
| **U6** | `U6+` | Preservation of the closed down station Französische Straße. |
| **U12** | `U12` | Bypass for construction works, consisting of U1 and U2. |
| **U15** | `U15` | Alternative line designation for the U1. |
| **U2** | `U23` | Line routing for past U2 services starting from Fehrbelliner Platz. |
| **U23** | `U23+` | Fictional combined line consisting of U2 and U3. |
| **U55** | `U55` | Past Kanzlerlinie. |
| **U55** | `U55+` | Fictional U55 from U-Bahn Sim Berlin's Trainz Simulator 2009 Add-On. |
| **U67** | `U67` | Fictional combined line consisting of U6 and U7. |



### Remote Control

The remote control requires accepting the User Account Control prompt that's triggered by the Simulator on startup. With it, key presses can be read systemwide for as long as the Simulator is running.

The keybinds for remote control are based on the vehicle control in SubwaySim 2. If there is a mismatch, you can edit the keybinds at `content/data/control_input/mapping.json`.