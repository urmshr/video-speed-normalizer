# Video Speed Normalizer

A Chrome extension that automatically resets the playback speed to 1.0x when playing YouTube videos that meet specific conditions.

This is useful if you always want to play music videos or videos of certain genres at 1.0x speed.

## Judgment Conditions

When playing a video that meets any of the following conditions, the playback speed will be set to 1.0x.

### Keywords

Videos are targeted if the title contains a set keyword. You can also include channel names in the judgment (default: disabled).

By default, the following keywords are set:
`MV`, `music`, `choreography` etc.

### Official Artist Badge (default: enabled)

Videos are targeted if an official artist badge (♪) is displayed next to the channel name.

### "Music" Section in Description (default: enabled)

Videos are targeted if there is a "Music" section in the video description.

### Title Format (default: disabled)

Videos are targeted if their title matches one of the following formats:

- `aaa "bbb"`, `aaa 'bbb'`
- `aaa「bbb」`, `aaa『bbb』`
- `aaa - bbb` (Supports multiple hyphen and dash symbols, including full-width and half-width)
- `aaa / bbb` (Supports full-width and half-width slashes)

## Exclude Keywords

If a title or channel name contains an exclude keyword, the playback speed will not be changed even if other conditions are met. This is empty by default.

## Settings

You can change the following settings from the extension's popup:

- Add/Delete Keywords
- Add/Delete Exclude Keywords
- Enable/Disable each judgment condition

## License

This software is licensed under the [MIT license](LICENSE).

## Disclaimer

- "YouTube" is a trademark or registered trademark of Google LLC.
- This extension is not affiliated with YouTube / Google LLC in any way.
- Use at your own risk. The developer is not responsible for any damages incurred through the use of this extension.
