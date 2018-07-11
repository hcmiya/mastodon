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

      const etext = mapping.filename.split('-').reduce((str, code) => str + String.fromCodePoint(parseInt(code, 16)), '');
      img = (<svg className='emojione' viewBox='0 0 10 10'>
          <g>
            <desc>{etext}</desc>
            <text x='5' y='5.5' fontSize='9' textAnchor='middle' dominantBaseline='middle'>{etext}</text>
          </g>
        </svg>);
    }

    return (
      <div className='autosuggest-emoji'>
        {img}
        {emoji.colons}
      </div>
    );
  }

}
