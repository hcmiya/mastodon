import React from 'react';
import PropTypes from 'prop-types';
import unicodeMapping from '../features/emoji/emoji_unicode_mapping_light';

export default class AutosuggestEmoji extends React.PureComponent {

  static propTypes = {
    emoji: PropTypes.object.isRequired,
  };

  render () {
    const { emoji } = this.props;
    let img;

    if (emoji.custom) {
      img = (<img className='emojione' src={emoji.imageUrl} alt={emoji.colons} />);
    } else {
      const mapping = unicodeMapping[emoji.native] || unicodeMapping[emoji.native.replace(/\uFE0F$/, '')];

      if (!mapping) {
        return null;
      }

      img = mapping.filename.split('-').reduce((str, code) => str + String.fromCodePoint(parseInt(code, 16)), '');
    }

    return (
      <div className='autosuggest-emoji'>{img} {emoji.colons}</div>
    );
  }

}
